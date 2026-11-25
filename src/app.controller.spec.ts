import { AppController } from './app.controller';
import { AppHelper } from './app.helper';
import { AppService } from './app.service';
import { SentryRequestType } from './app';
import { Logger } from 'winston';

describe('AppController', () => {
  const originalRules = process.env.SENTRY_IGNORE_RULES;
  const originalSendUnresolved = process.env.SEND_UNRESOLVED_NOTIFICATIONS;
  let controller: AppController;
  let service: {
    getHello: jest.Mock;
    getIssueDetail: jest.Mock;
    sentTelegramMessage: jest.Mock;
  };
  let logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    delete process.env.SEND_UNRESOLVED_NOTIFICATIONS;
    process.env.SENTRY_IGNORE_RULES = JSON.stringify([
      { title: '*ExampleError*', category: 'exception.ExampleError' },
    ]);
    const helper = new AppHelper();
    helper.onModuleInit();
    jest.spyOn(helper, 'isAllowNotification').mockReturnValue(true);
    service = {
      getHello: jest.fn().mockReturnValue({ message: 'Hello World!' }),
      getIssueDetail: jest
        .fn()
        .mockResolvedValue({ category: 'exception.ExampleError' }),
      sentTelegramMessage: jest.fn().mockResolvedValue(undefined),
    };
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    controller = new AppController(
      logger as unknown as Logger,
      service as unknown as AppService,
      helper,
    );
  });

  afterEach(() => {
    if (originalRules === undefined) {
      delete process.env.SENTRY_IGNORE_RULES;
    } else {
      process.env.SENTRY_IGNORE_RULES = originalRules;
    }
    if (originalSendUnresolved === undefined) {
      delete process.env.SEND_UNRESOLVED_NOTIFICATIONS;
    } else {
      process.env.SEND_UNRESOLVED_NOTIFICATIONS = originalSendUnresolved;
    }
  });

  async function webhook(data: unknown, action = 'triggered') {
    const response = controller.webhooks({
      action,
      data,
    } as SentryRequestType);
    await new Promise((resolve) => setImmediate(resolve));
    expect(response).toEqual({ message: 'success' });
    expect(logger.error).not.toHaveBeenCalled();
  }

  it('returns the hello response', () => {
    expect(controller.getHello()).toEqual({ message: 'Hello World!' });
  });

  it('sends unresolved notifications by default', async () => {
    await webhook(
      { issue: { id: '123', title: 'Unrelated error' } },
      'unresolved',
    );
    expect(service.sentTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({ issueAction: 'unresolved' }),
    );
  });

  it('skips unresolved notifications when disabled', async () => {
    process.env.SEND_UNRESOLVED_NOTIFICATIONS = ' false ';
    await webhook(
      { issue: { id: '123', title: 'Unrelated error' } },
      'unresolved',
    );
    expect(service.getIssueDetail).not.toHaveBeenCalled();
    expect(service.sentTelegramMessage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Unresolved notification skipped');
  });

  it('still sends other actions when unresolved notifications are disabled', async () => {
    process.env.SEND_UNRESOLVED_NOTIFICATIONS = 'false';
    await webhook(
      { issue: { id: '123', title: 'Unrelated error' } },
      'triggered',
    );
    expect(service.sentTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it.each(['event', 'error'])(
    'filters %s notifications with different tag formats',
    async (kind) => {
      for (const tags of [
        { category: 'exception.ExampleError' },
        [['category', 'exception.ExampleError']],
        [{ key: 'category', value: 'exception.ExampleError' }],
      ]) {
        await webhook({
          [kind]: {
            title: 'ExampleError: expected failure',
            tags,
          },
        });
      }
      expect(service.sentTelegramMessage).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Telegram notification skipped by SENTRY_IGNORE_RULES',
      );
    },
  );

  it('uses issue_category when event tags are absent', async () => {
    await webhook({
      event: {
        title: 'ExampleError',
        issue_category: 'exception.ExampleError',
      },
    });
    expect(service.sentTelegramMessage).not.toHaveBeenCalled();
  });

  it('filters issue notifications using API category tags', async () => {
    await webhook({ issue: { id: '123', title: 'ExampleError' } });
    expect(service.getIssueDetail).toHaveBeenCalledWith('123');
    expect(service.sentTelegramMessage).not.toHaveBeenCalled();
  });

  it('falls back to issueCategory when the API request fails', async () => {
    service.getIssueDetail.mockRejectedValue(new Error('API unavailable'));
    await webhook({
      issue: {
        id: '123',
        title: 'ExampleError',
        issueCategory: 'exception.ExampleError',
      },
    });
    expect(service.sentTelegramMessage).not.toHaveBeenCalled();
  });

  it.each([
    {
      title: 'Unrelated error',
      tags: { category: 'exception.ExampleError' },
    },
    { title: 'ExampleError', tags: { category: 'another.category' } },
    { title: 'ExampleError' },
  ])('sends notifications that do not match both fields: %j', async (event) => {
    await webhook({ event });
    expect(service.sentTelegramMessage).toHaveBeenCalledTimes(1);
  });
});

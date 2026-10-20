import { AppHelper } from './app.helper';

describe('SENTRY_IGNORE_RULES', () => {
  const originalRules = process.env.SENTRY_IGNORE_RULES;
  let helper: AppHelper;

  beforeEach(() => {
    delete process.env.SENTRY_IGNORE_RULES;
    helper = new AppHelper();
  });

  afterEach(() => {
    if (originalRules === undefined) {
      delete process.env.SENTRY_IGNORE_RULES;
    } else {
      process.env.SENTRY_IGNORE_RULES = originalRules;
    }
  });

  function configure(rules: unknown) {
    process.env.SENTRY_IGNORE_RULES = JSON.stringify(rules);
    helper.onModuleInit();
  }

  it.each([undefined, '', '  ', '[]'])('disables filtering for %s', (value) => {
    if (value !== undefined) process.env.SENTRY_IGNORE_RULES = value;
    helper.onModuleInit();
    expect(helper.isIgnoredNotification({ title: 'any error' })).toBe(false);
  });

  it('requires both title and category to match', () => {
    configure([
      {
        title: '*ExampleError: expected failure*',
        category: 'exception.ExampleError',
      },
    ]);
    const title = 'ExampleError: expected failure test';
    expect(
      helper.isIgnoredNotification({
        title,
        category: 'exception.ExampleError',
      }),
    ).toBe(true);
    expect(helper.isIgnoredNotification({ title })).toBe(false);
    expect(
      helper.isIgnoredNotification({
        title: 'Another ExampleError',
        category: 'exception.ExampleError',
      }),
    ).toBe(false);
  });

  it('supports title-only and category-only rules with OR semantics', () => {
    configure([
      { title: 'Ignored*' },
      { category: 'exception.ExampleError' },
    ]);
    expect(helper.isIgnoredNotification({ title: 'Ignored error' })).toBe(true);
    expect(
      helper.isIgnoredNotification({ category: 'exception.ExampleError' }),
    ).toBe(true);
    expect(helper.isIgnoredNotification({ title: 'Other' })).toBe(false);
  });

  it('supports multiple title and category exclusions in the same list', () => {
    configure([
      {
        title: '*ExampleError: expected failure*',
        category: 'exception.ExampleError',
      },
      {
        title: '*Example connection timeout*',
        category: 'example.connection',
      },
    ]);
    expect(
      helper.isIgnoredNotification({
        title: 'ExampleError: expected failure test',
        category: 'exception.ExampleError',
      }),
    ).toBe(true);
    expect(
      helper.isIgnoredNotification({
        title: 'ExampleError: Example connection timeout.',
        category: 'example.connection',
      }),
    ).toBe(true);
    expect(
      helper.isIgnoredNotification({
        title: 'ExampleError: Unrelated connection failure.',
        category: 'example.connection',
      }),
    ).toBe(false);
    expect(
      helper.isIgnoredNotification({
        title: 'Example connection timeout.',
        category: 'another.category',
      }),
    ).toBe(false);
  });

  it('matches whole fields case-sensitively and escapes regex characters', () => {
    configure([{ title: 'Error: [S3] (file).json? + $ ^ | \\' }]);
    const title = 'Error: [S3] (file).json? + $ ^ | \\';
    expect(helper.isIgnoredNotification({ title })).toBe(true);
    expect(helper.isIgnoredNotification({ title: `prefix ${title}` })).toBe(
      false,
    );
    expect(helper.isIgnoredNotification({ title: title.toLowerCase() })).toBe(
      false,
    );
    configure([{ category: 'exception.ExampleError' }]);
    expect(
      helper.isIgnoredNotification({ category: 'exceptionXExampleError' }),
    ).toBe(false);
  });

  it('supports multiple wildcards and multiline titles', () => {
    configure([{ title: '*Example*failure*' }]);
    expect(
      helper.isIgnoredNotification({ title: 'ExampleError:\nexpected failure' }),
    ).toBe(true);
  });

  it.each([
    '{}',
    'null',
    'invalid json',
    '[null]',
    '[[]]',
    '[{}]',
    '[{"title":""}]',
    '[{"category":"   "}]',
    '[{"title":123}]',
    '[{"title":"*","unknown":"value"}]',
  ])('rejects invalid configuration %s', (value) => {
    process.env.SENTRY_IGNORE_RULES = value;
    expect(() => helper.onModuleInit()).toThrow('Invalid SENTRY_IGNORE_RULES');
  });
});

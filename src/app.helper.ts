import { Injectable, OnModuleInit } from '@nestjs/common';
import { HookMessageDataType } from './app';
import {
  generateHookMessageEn,
  generateHookMessageVi,
  generateHookMessageRu,
} from './app.utils';

@Injectable()
export class AppHelper implements OnModuleInit {
  private ignoreRules: { title?: RegExp; category?: RegExp }[] = [];

  onModuleInit(): void {
    const config = process.env.SENTRY_IGNORE_RULES;
    if (!config?.trim()) {
      this.ignoreRules = [];
      return;
    }

    try {
      const rules: unknown = JSON.parse(config);
      if (!Array.isArray(rules)) {
        throw new Error('expected a JSON array');
      }

      this.ignoreRules = rules.map((rule, index) => {
        if (
          !rule ||
          typeof rule !== 'object' ||
          Array.isArray(rule) ||
          Object.keys(rule).length === 0 ||
          Object.keys(rule).some(
            (key) => key !== 'title' && key !== 'category',
          ) ||
          Object.values(rule).some(
            (value) => typeof value !== 'string' || !value.trim(),
          )
        ) {
          throw new Error(
            `rule ${index + 1} must contain a non-empty title and/or category string`,
          );
        }

        return {
          title: rule.title ? this.compilePattern(rule.title) : undefined,
          category: rule.category
            ? this.compilePattern(rule.category)
            : undefined,
        };
      });
    } catch (error) {
      throw new Error(`Invalid SENTRY_IGNORE_RULES: ${error.message}`);
    }
  }

  isIgnoredNotification(data: HookMessageDataType): boolean {
    return this.ignoreRules.some(
      (rule) =>
        (!rule.title || rule.title.test(data.title || '')) &&
        (!rule.category || rule.category.test(data.category || '')),
    );
  }

  private compilePattern(pattern: string): RegExp {
    const escaped = pattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\S]*');
    return new RegExp(`^${escaped}$`);
  }

  generateHookMessage(data: HookMessageDataType): string {
    switch (process.env.LANGUAGE) {
      case 'vi':
        return generateHookMessageVi(data);
      case 'ru':
        return generateHookMessageRu(data);
      default:
        return generateHookMessageEn(data);
    }
  }

  isAllowNotification(projectSlug: string): boolean {
    const sentryProjectSlugFilter: string =
      process.env.SENTRY_PROJECT_SLUG_ALLOW_LIST;
    if (!sentryProjectSlugFilter) {
      return true;
    }
    const projectSlugFilter = sentryProjectSlugFilter
      .split(',')
      .map((item) => item.trim())
      .filter((item) => !!item);
    if (
      projectSlugFilter.length > 0 &&
      !projectSlugFilter.includes(projectSlug)
    ) {
      return false;
    }
    return true;
  }
}

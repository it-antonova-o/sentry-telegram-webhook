import { HookMessageDataType } from './app';

function getIssueEmoji(issueAction?: string): string {
  switch (issueAction) {
    case 'resolved':
      return '✅';
    default:
      return '💣';
  }
}

function formatOptionalField(label: string, value?: string): string {
  if (!value || value.trim().toLowerCase() === 'none') {
    return '';
  }
  return `*${label}:* ${value}\n`;
}

export function generateHookMessageEn(data: HookMessageDataType) {
  const _data: HookMessageDataType = escapedHookMessageData(data);
  const emoji = getIssueEmoji(data.issueAction);
  return `
*${emoji} Issue ${_data.issueAction}:*
*Project:* ${_data.appName || 'none'}
*Title:* ${_data.title || 'none'}
*Position:* ${_data.errorPosition || 'none'}
${formatOptionalField('Environment', _data.environment)}${formatOptionalField('Version', _data.release)}${formatOptionalField('Devices', _data.device)}${formatOptionalField('Category', _data.category)}${formatOptionalField('Server name', _data.server_name)}${formatOptionalField('URL', _data.url)}*Detail:* [HERE](${_data.detailLink})
  `;
}

export function generateHookMessageVi(data: HookMessageDataType) {
  const _data: HookMessageDataType = escapedHookMessageData(data);
  const emoji = getIssueEmoji(data.issueAction);
  return `
*${emoji} Lỗi về \\(${_data.issueAction || 'none'}\\):*
*Tên app:* ${_data.appName || 'none'}
*Tiêu đề:* ${_data.title || 'none'}
*Lỗi ở:* ${_data.errorPosition || 'none'}
${formatOptionalField('Môi trường', _data.environment)}${formatOptionalField('Phiên bản', _data.release)}${formatOptionalField('Thiết bị', _data.device)}${formatOptionalField('Danh mục', _data.category)}${formatOptionalField('Máy chủ', _data.server_name)}${formatOptionalField('URL', _data.url)}*Xem chi tiết:* [TẠI ĐÂY](${_data.detailLink}) 
  `;
}

export function generateHookMessageRu(data: HookMessageDataType) {
  const _data: HookMessageDataType = escapedHookMessageData(data);
  const emoji = getIssueEmoji(data.issueAction);
  return `
*${emoji} Ошибка \\(${_data.issueAction || 'none'}\\):*
*Проект:* ${_data.appName || 'none'}
*Заголовок:* ${_data.title || 'none'}
*Позиция:* ${_data.errorPosition || 'none'}
${formatOptionalField('Окружение', _data.environment)}${formatOptionalField('Версия', _data.release)}${formatOptionalField('Устройство', _data.device)}${formatOptionalField('Категория', _data.category)}${formatOptionalField('Сервер', _data.server_name)}${formatOptionalField('URL', _data.url)}*Подробнее:* [ЗДЕСЬ](${_data.detailLink})
  `;
}

function escapedHookMessageData(
  input: HookMessageDataType,
): HookMessageDataType {
  const output: HookMessageDataType = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] =
      typeof value === 'string'
        ? value.replace(/([|{\[\]*_~}+)(#>!=\-.])/gm, '\\$1')
        : '';
  }
  return output;
}

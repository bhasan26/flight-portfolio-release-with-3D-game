export const CONTACT_LIMITS = Object.freeze({ name: 120, email: 254, message: 10000 });

export function validateContact({ name, email, message, gotcha = '' }) {
  if (gotcha) return { error: 'Please use the email link to get in touch.' };
  if ([name, email, message].some(value => typeof value !== 'string')) {
    return { error: 'Please complete all contact fields.' };
  }
  const fields = { name: name.trim(), email: email.trim(), message: message.trim() };
  if (!fields.name || !fields.message) return { error: 'Please enter your name and a message.' };
  for (const [field, limit] of Object.entries(CONTACT_LIMITS)) {
    if (fields[field].length > limit) return { error: `Please keep your ${field} to ${limit} characters or fewer.` };
  }
  if (/[\r\n\u0000]/u.test(fields.name + fields.email) || !/^[^\s@]+@[^\s@]+$/u.test(fields.email)) {
    return { error: 'Please enter a valid name and email address.' };
  }
  if (fields.message.includes('\u0000')) return { error: 'Please remove invalid characters from your message.' };
  return { fields };
}

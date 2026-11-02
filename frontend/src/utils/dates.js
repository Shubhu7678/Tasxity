export const zonedDateTimeValue = (value, timezone) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

export const zonedDateTimeToISO = (value, timezone) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid date and time.');
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59
    || new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid date and time.');
  }
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const formatted = zonedDateTimeValue(new Date(guess), timezone);
    if (!formatted) throw new Error('Invalid timezone.');
    const [localDate, localTime] = formatted.split('T');
    const [localYear, localMonth, localDay] = localDate.split('-').map(Number);
    const [localHour, localMinute] = localTime.split(':').map(Number);
    guess += target - Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute);
  }
  if (zonedDateTimeValue(new Date(guess), timezone) !== value) {
    throw new Error('That local time does not exist in the selected timezone.');
  }
  return new Date(guess).toISOString();
};

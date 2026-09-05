import { TickMarkType, type TickMarkFormatter, type Time, type TimeFormatterFn } from 'lightweight-charts';

const yearFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
const dayFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit' });
const minuteFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const secondFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const crosshairFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const asDate = (time: Time) => (typeof time === 'number' ? new Date(time * 1000) : null);

export const localTickMarkFormatter: TickMarkFormatter = (time, tickMarkType) => {
  const date = asDate(time);
  if (!date) return null;
  if (tickMarkType === TickMarkType.Year) return yearFormatter.format(date);
  if (tickMarkType === TickMarkType.Month) return monthFormatter.format(date);
  if (tickMarkType === TickMarkType.DayOfMonth) return dayFormatter.format(date);
  if (tickMarkType === TickMarkType.TimeWithSeconds) return secondFormatter.format(date);
  return minuteFormatter.format(date);
};

export const localTimeFormatter: TimeFormatterFn<Time> = (time) => {
  const date = asDate(time);
  return date ? crosshairFormatter.format(date) : String(time);
};

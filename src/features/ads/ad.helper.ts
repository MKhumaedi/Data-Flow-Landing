import { AdBookingItem, BookingStatus } from './ad.types';

export function computeBookingStatus(booking: {
  status: BookingStatus;
  startDate: Date | string;
  endDate: Date | string;
}): BookingStatus {
  if (booking.status === 'CANCELLED') return 'CANCELLED';
  const now = new Date().getTime();
  const start = new Date(booking.startDate).getTime();
  const end = new Date(booking.endDate).getTime();

  if (now < start) return 'SCHEDULED';
  if (now >= start && now <= end) return 'ACTIVE';
  return 'EXPIRED';
}

export function calculateEstimatedPrice(
  startDateStr: string,
  endDateStr: string,
  pricePerWeek: number,
  pricePerMonth: number
): number {
  const start = new Date(startDateStr).getTime();
  const end = new Date(endDateStr).getTime();
  const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));

  if (diffDays >= 30) {
    const months = diffDays / 30;
    return Math.round(months * pricePerMonth);
  }
  const weeks = diffDays / 7;
  return Math.round(weeks * pricePerWeek);
}

export function formatBookingWithStatus(b: any): AdBookingItem {
  const status = b.status as BookingStatus;
  const computed = computeBookingStatus({
    status,
    startDate: b.startDate,
    endDate: b.endDate,
  });

  return {
    ...b,
    pricePaid: Number(b.pricePaid),
    status: computed,
    computedStatus: computed,
  };
}

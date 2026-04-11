"use client";
import { useRouter } from "next/navigation";
import BookingForm from "@/components/BookingForm";

export default function NewBookingPage() {
  const router = useRouter();
  return (
    <BookingForm
      booking={null}
      onClose={() => router.push("/bookings")}
      onSaved={() => router.push("/bookings")}
    />
  );
}

'use client';

import React from "react";
import { CalendarBody } from "@/components/calendar-module/calendar-body";
import { CalendarProvider } from "@/components/calendar-module/contexts/calendar-context";
import { DndProvider } from "@/components/calendar-module/contexts/dnd-context";
import { CalendarHeaderReadOnly } from "@/components/calendar-module/header/calendar-header-readonly";
import { IEvent, IUser } from "@/components/calendar-module/interfaces";

interface CalendarWrapperProps {
  events: IEvent[];
  users?: IUser[];
  initialView?: 'day' | 'week' | 'month' | 'year' | 'agenda';
}

export function CalendarWrapper({
  events,
  users = [],
  initialView = 'week'
}: CalendarWrapperProps) {
  return (
    <CalendarProvider events={events} users={users} view={initialView}>
      <DndProvider showConfirmation={false}>
        <div className="w-full border rounded-xl">
          <CalendarHeaderReadOnly />
          <CalendarBody />
        </div>
      </DndProvider>
    </CalendarProvider>
  );
}

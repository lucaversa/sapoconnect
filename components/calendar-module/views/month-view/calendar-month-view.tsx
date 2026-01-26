import { motion } from "framer-motion";
import { useMemo } from "react";
import {
	staggerContainer,
	transition,
} from "@/components/calendar-module/animations";
import { useCalendar } from "@/components/calendar-module/contexts/calendar-context";

import {
	calculateMonthEventPositions,
	getCalendarCells,
} from "@/components/calendar-module/helpers";

import type { IEvent } from "@/components/calendar-module/interfaces";
import { DayCell } from "@/components/calendar-module/views/month-view/day-cell";

interface IProps {
	singleDayEvents: IEvent[];
	multiDayEvents: IEvent[];
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthView({ singleDayEvents, multiDayEvents }: IProps) {
	const { selectedDate } = useCalendar();

	const allEvents = [...multiDayEvents, ...singleDayEvents];

	const cells = useMemo(() => getCalendarCells(selectedDate), [selectedDate]);

	const eventPositions = useMemo(
		() =>
			calculateMonthEventPositions(
				multiDayEvents,
				singleDayEvents,
				selectedDate,
			),
		[multiDayEvents, singleDayEvents, selectedDate],
	);

	return (
		<motion.div initial="initial" animate="animate" variants={staggerContainer}>
			<div className="grid grid-cols-7">
				{WEEK_DAYS.map((day, index) => (
					<motion.div
						key={day}
						className="flex items-center justify-center py-2"
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: index * 0.05, ...transition }}
					>
						<span className="text-xs font-medium text-t-quaternary">{day}</span>
					</motion.div>
				))}
			</div>

			<div className="grid grid-cols-7 overflow-hidden">
				{cells.map((cell, index) => (
					<DayCell
						key={index}
						cell={cell}
						events={allEvents}
						eventPositions={eventPositions}
					/>
				))}
			</div>
		</motion.div>
	);
}

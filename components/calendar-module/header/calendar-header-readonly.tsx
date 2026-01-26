"use client";

import { motion } from "framer-motion";

import {
	slideFromLeft,
	slideFromRight,
	transition,
} from "@/components/calendar-module/animations";
import { useCalendar } from "@/components/calendar-module/contexts/calendar-context";
import { DateNavigator } from "@/components/calendar-module/header/date-navigator";
import { TodayButton } from "@/components/calendar-module/header/today-button";
import Views from "./view-tabs";

export function CalendarHeaderReadOnly() {
	const { view, events } = useCalendar();

	return (
		<div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
			<motion.div
				className="flex items-center gap-3"
				variants={slideFromLeft}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<TodayButton />
				<DateNavigator view={view} events={events} />
			</motion.div>

			<motion.div
				className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-1.5"
				variants={slideFromRight}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<div className="options flex-wrap flex items-center gap-4 md:gap-2">
					<Views />
				</div>
			</motion.div>
		</div>
	);
}

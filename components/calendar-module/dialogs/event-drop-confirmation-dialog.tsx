"use client";

import {format} from "date-fns";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {IEvent} from "@/components/calendar-module/interfaces";
import {formatTime, getColorClass} from "@/components/calendar-module/helpers";
import {cn} from "@/lib/utils";
import {useCalendar} from "@/components/calendar-module/contexts/calendar-context";

interface EventDropConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: IEvent | null;
    newStartDate: Date | null;
    newEndDate: Date | null;
    onConfirm: () => void;
    onCancel: () => void;
}

export function EventDropConfirmationDialog({
                                                open,
                                                onOpenChange,
                                                event,
                                                newStartDate,
                                                newEndDate,
                                                onConfirm,
                                                onCancel,
                                            }: EventDropConfirmationDialogProps) {

    const {use24HourFormat} = useCalendar();

    if (!event || !newStartDate || !newEndDate) {
        return null;
    }

    const originalStart = new Date(event.startDate);

    const formatDate = (date: Date) => {
        return format(date, "MMM dd, yyyy 'at '") + formatTime(date, use24HourFormat);
    };

    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    const handleCancel = () => {
        onCancel();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Event Move</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to move
                        <span className={cn(getColorClass(event.color), "mx-1 py-0.5 px-1 rounded-md")}>
							{event.title}
						</span>
                        event from
                        <strong className="mx-1">{formatDate(originalStart)}</strong> to
                        <strong className="mx-1">{formatDate(newStartDate)}</strong>?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm}>
                        Move Event
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

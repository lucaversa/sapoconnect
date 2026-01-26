"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
	className,
	icon,
	thumbClassName,
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
	icon?: React.ReactNode;
	thumbClassName?: string;
}) {
	return (
		<SwitchPrimitive.Root
			className={cn(
				"peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				className={cn(
					"pointer-events-none flex h-6 w-6 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0 items-center justify-center data-[state=checked]:translate-x-5",
					thumbClassName,
				)}
			>
				{icon ? icon : null}
			</SwitchPrimitive.Thumb>
		</SwitchPrimitive.Root>
	);
}

export { Switch };

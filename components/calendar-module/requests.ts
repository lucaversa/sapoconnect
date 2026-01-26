import {
	CALENDAR_ITEMS_MOCK,
	USERS_MOCK,
} from "@/components/calendar-module/mocks";

export const getEvents = async () => {
	return CALENDAR_ITEMS_MOCK;
};

export const getUsers = async () => {
	return USERS_MOCK;
};

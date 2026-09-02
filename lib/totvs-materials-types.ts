export interface TotvsMaterial {
  id: string;
  title: string;
  fileName: string;
  sizeLabel: string;
  publishedAt: string | null;
  publishedAtLabel: string | null;
  downloadUrl: string;
}

export interface TotvsMaterialsCourse {
  id: string;
  name: string;
  materials: TotvsMaterial[];
}

export interface TotvsMaterialsOverview {
  courses: TotvsMaterialsCourse[];
  fetchedAt: string;
  __cacheStale?: boolean;
}

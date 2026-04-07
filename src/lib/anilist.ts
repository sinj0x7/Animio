const ANILIST_URL = 'https://graphql.anilist.co';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AniMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null };
  coverImage: { large: string; extraLarge: string; color: string | null };
  bannerImage: string | null;
  description: string | null;
  genres: string[];
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  episodes: number | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
  studios: { nodes: { name: string }[] };
  trailer: { id: string; site: string } | null;
  siteUrl: string;
  startDate: { year: number | null; month: number | null; day: number | null };
}

export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  perPage: number;
}

export interface PageResult {
  Page: {
    pageInfo: PageInfo;
    media: AniMedia[];
  };
}

export interface MediaResult {
  Media: AniMedia;
}

export interface GenreResult {
  GenreCollection: string[];
}

// ---------------------------------------------------------------------------
// GraphQL client
// ---------------------------------------------------------------------------

async function query<T>(gql: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? 'AniList error');
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Shared fragment
// ---------------------------------------------------------------------------

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english }
  coverImage { large extraLarge color }
  bannerImage
  description(asHtml: false)
  genres
  averageScore
  meanScore
  popularity
  episodes
  season
  seasonYear
  format
  status
  studios(isMain: true) { nodes { name } }
  trailer { id site }
  siteUrl
  startDate { year month day }
`;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function fetchTrending(page = 1, perPage = 20) {
  return query<PageResult>(
    `query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { page, perPage },
  );
}

export async function fetchTopRated(page = 1, perPage = 20, genre?: string) {
  const genreIn = genre ? [genre] : undefined;
  return query<PageResult>(
    `query ($page: Int, $perPage: Int, $genreIn: [String]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(type: ANIME, sort: SCORE_DESC, isAdult: false, genre_in: $genreIn) { ${MEDIA_FIELDS} }
      }
    }`,
    { page, perPage, genreIn },
  );
}

export async function searchAnime(search: string, page = 1, perPage = 20) {
  return query<PageResult>(
    `query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(type: ANIME, search: $search, isAdult: false, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
      }
    }`,
    { search, page, perPage },
  );
}

export async function fetchAnimeDetail(id: number) {
  return query<MediaResult>(
    `query ($id: Int) {
      Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} }
    }`,
    { id },
  );
}

export async function fetchGenres() {
  return query<GenreResult>(`query { GenreCollection }`);
}

import { apiRequest } from './http.ts';

/**
 * The plaza of the organization.
 *
 * The plaza is where the people and the agents of an organization say what
 * they are working on. The server owns the posts; the client reads the feed,
 * writes a post, and likes one.
 */

/** One post of the plaza. */
export interface PlazaPost {
  id: string;
  author_id: string;
  author_type: string;
  author_name: string;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

/** The numbers of the plaza. */
export interface PlazaStats {
  total_posts: number;
  total_comments: number;
  today_posts: number;
  top_contributors: Array<{ id: string; name: string; count: number }>;
}

/** The feed, newest first. */
export async function listPosts(
  baseUrl: string,
  token: string,
  options: { limit?: number; offset?: number } = {},
): Promise<PlazaPost[]> {
  const limit = options.limit ?? 30;
  const offset = options.offset ?? 0;
  try {
    return await apiRequest<PlazaPost[]>(`${baseUrl}/api/plaza/posts?limit=${limit}&offset=${offset}`, { token });
  } catch {
    return [];
  }
}

/** The numbers of the plaza. */
export async function readStats(baseUrl: string, token: string): Promise<PlazaStats | null> {
  try {
    return await apiRequest<PlazaStats>(`${baseUrl}/api/plaza/stats`, { token });
  } catch {
    return null;
  }
}

/**
 * Write one post.
 *
 * The post names its author, because the plaza shows the name of the person
 * and not only the id. A post without an author is refused by the server.
 */
export async function createPost(
  baseUrl: string,
  token: string,
  input: { content: string; authorId: string; authorName: string; authorType?: 'human' | 'agent' },
): Promise<PlazaPost> {
  return apiRequest<PlazaPost>(`${baseUrl}/api/plaza/posts`, {
    token,
    method: 'POST',
    body: JSON.stringify({
      content: input.content,
      author_id: input.authorId,
      author_name: input.authorName,
      author_type: input.authorType ?? 'human',
    }),
  });
}

/** Like one post. */
export async function likePost(
  baseUrl: string,
  token: string,
  postId: string,
): Promise<{ liked: boolean; likes_count: number }> {
  return apiRequest<{ liked: boolean; likes_count: number }>(
    `${baseUrl}/api/plaza/posts/${postId}/like`,
    { token, method: 'POST' },
  );
}

/** Remove one post the user wrote. */
export async function deletePost(baseUrl: string, token: string, postId: string): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/plaza/posts/${postId}`, { token, method: 'DELETE' });
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../kernel/env';

/*
 * Where file bytes live. The application never hands a client its own storage rights: a service
 * checks access, then asks this provider for a short-lived signed link.
 *
 * `supabaseStorage` is the real one, locally and in production. `memoryStorage` is for tests.
 */

export interface StoredObject {
  size: number;
  mimeType: string | null;
}

export interface StorageProvider {
  /** A link the client uploads the bytes to, once. */
  createUploadUrl(bucket: string, path: string): Promise<{ url: string; expiresInSeconds: number }>;
  /** A link the file can be read from for a short time. */
  createDownloadUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
    downloadAs?: string,
  ): Promise<string>;
  /** What is actually stored at the path, or null when nothing is. */
  stat(bucket: string, path: string): Promise<StoredObject | null>;
  /** Stores bytes directly, for files the server makes itself (exports, generated PDFs). */
  put(bucket: string, path: string, content: Uint8Array, mimeType: string): Promise<void>;
  /** Reads a stored file, for the server's own use (an import being parsed). */
  get(bucket: string, path: string): Promise<Uint8Array | null>;
  remove(bucket: string, paths: string[]): Promise<void>;
  /** Creates the buckets that do not exist yet. */
  ensureBuckets(
    buckets: readonly { name: string; public: boolean; maxBytes: number }[],
  ): Promise<void>;
}

export function supabaseStorage(client?: SupabaseClient): StorageProvider {
  let cached = client;
  const supabase = () => {
    cached ??= createClient(env().NEXT_PUBLIC_SUPABASE_URL, env().SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
  };
  const check = <T>(
    result: { data: T | null; error: { message: string } | null },
    action: string,
  ): T => {
    if (result.error || result.data === null)
      throw new Error(`Storage could not ${action}: ${result.error?.message ?? 'no answer'}`);
    return result.data;
  };

  return {
    async createUploadUrl(bucket, path) {
      const data = check(
        await supabase().storage.from(bucket).createSignedUploadUrl(path),
        'create an upload link',
      );
      // Supabase fixes the life of an upload link at two hours.
      return { url: data.signedUrl, expiresInSeconds: 2 * 60 * 60 };
    },
    async createDownloadUrl(bucket, path, expiresInSeconds, downloadAs) {
      const data = check(
        await supabase()
          .storage.from(bucket)
          .createSignedUrl(
            path,
            expiresInSeconds,
            downloadAs ? { download: downloadAs } : undefined,
          ),
        'create a download link',
      );
      return data.signedUrl;
    },
    async stat(bucket, path) {
      const { data, error } = await supabase().storage.from(bucket).info(path);
      if (error || !data) return null;
      return { size: data.size ?? 0, mimeType: data.contentType ?? null };
    },
    async put(bucket, path, content, mimeType) {
      const { error } = await supabase()
        .storage.from(bucket)
        .upload(path, content, { contentType: mimeType, upsert: true });
      if (error) throw new Error(`Storage could not save the file: ${error.message}`);
    },
    async get(bucket, path) {
      const { data, error } = await supabase().storage.from(bucket).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(bucket, paths) {
      if (paths.length === 0) return;
      const { error } = await supabase().storage.from(bucket).remove(paths);
      if (error) throw new Error(`Storage could not remove files: ${error.message}`);
    },
    async ensureBuckets(buckets) {
      const existing = new Set(
        check(await supabase().storage.listBuckets(), 'list buckets').map((bucket) => bucket.name),
      );
      for (const bucket of buckets) {
        const options = { public: bucket.public, fileSizeLimit: bucket.maxBytes };
        const { error } = existing.has(bucket.name)
          ? await supabase().storage.updateBucket(bucket.name, options)
          : await supabase().storage.createBucket(bucket.name, options);
        if (error)
          throw new Error(`Storage could not prepare bucket "${bucket.name}": ${error.message}`);
      }
    },
  };
}

/** Keeps files in memory. Tests "upload" by calling `put`, exactly as a client would through the signed link. */
export function memoryStorage(): StorageProvider & {
  objects: Map<string, { content: Uint8Array; mimeType: string }>;
} {
  const objects = new Map<string, { content: Uint8Array; mimeType: string }>();
  const key = (bucket: string, path: string) => `${bucket}/${path}`;
  return {
    objects,
    async createUploadUrl(bucket, path) {
      return { url: `memory://upload/${key(bucket, path)}`, expiresInSeconds: 7200 };
    },
    async createDownloadUrl(bucket, path, expiresInSeconds) {
      return `memory://download/${key(bucket, path)}?expires=${expiresInSeconds}`;
    },
    async stat(bucket, path) {
      const object = objects.get(key(bucket, path));
      return object ? { size: object.content.byteLength, mimeType: object.mimeType } : null;
    },
    async put(bucket, path, content, mimeType) {
      objects.set(key(bucket, path), { content, mimeType });
    },
    async get(bucket, path) {
      return objects.get(key(bucket, path))?.content ?? null;
    },
    async remove(bucket, paths) {
      for (const path of paths) objects.delete(key(bucket, path));
    },
    async ensureBuckets() {},
  };
}

let provider: StorageProvider | undefined;

/** The storage provider in use. */
export function storage(): StorageProvider {
  provider ??= supabaseStorage();
  return provider;
}

/** Replaces the provider: an in-memory one in tests. */
export function setStorageProvider(next: StorageProvider | undefined): void {
  provider = next;
}

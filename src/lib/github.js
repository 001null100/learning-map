const API = 'https://api.github.com';

function headers(connection) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${connection.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function request(connection, url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    ...options,
    headers: { ...headers(connection), ...(options.headers || {}) },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.message || detail;
    } catch {
      // Keep status text when GitHub does not return JSON.
    }
    throw new Error(`GitHub ${response.status}: ${detail}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function encodePath(path = '') {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function contentUrl(connection, path = '') {
  return `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${encodePath(path)}`;
}

function repositoryContentUrl(repositoryFullName, path = '', ref = null) {
  const [owner, repo] = repositoryFullName.split('/');
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`;
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function decodeContentResult(result, path) {
  if (Array.isArray(result) || result.type !== 'file' || !result.content) {
    throw new Error(`Expected a file at ${path}`);
  }
  return {
    path,
    sha: result.sha,
    text: decodeBase64(result.content),
  };
}

export async function testConnection(connection) {
  return request(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`,
  );
}

export async function readFile(connection, path) {
  const result = await request(connection, contentUrl(connection, path));
  return decodeContentResult(result, path);
}

export async function readRepositoryFile(connection, repositoryFullName, path, ref = null) {
  const result = await request(connection, repositoryContentUrl(repositoryFullName, path, ref));
  return decodeContentResult(result, `${repositoryFullName}:${path}`);
}

export async function readJson(connection, path) {
  const file = await readFile(connection, path);
  try {
    return { ...file, data: JSON.parse(file.text) };
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

export async function writeFile(connection, path, text, sha, message) {
  const body = {
    message,
    content: encodeBase64(text),
    ...(sha ? { sha } : {}),
  };
  return request(connection, contentUrl(connection, path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function writeJson(connection, path, data, sha, message) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  return writeFile(connection, path, text, sha, message);
}

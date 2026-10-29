// Code execution using Judge0 CE (free public instance)
const JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com/submissions';

// Judge0 CE language IDs
const LANGUAGE_IDS = {
  javascript: 63,
  typescript: 74,
  python:     71,
  java:       62,
  cpp:        54,
  c:          50,
  csharp:     51,
  php:        68,
  ruby:       72,
  go:         60,
  rust:       73,
  swift:      83,
};


async function runUserCode(languageId, code, stdin) {
  const lang = languageId || 'plaintext';
  const source = typeof code === 'string' ? code : '';

  if (!source.trim())
    return { stdout: '', stderr: 'Editor is empty. Write some code and click Run.', isError: true };

  if (lang === 'plaintext')
    return { stdout: '', stderr: 'Plain text cannot be executed. Select a programming language.', isError: true };





  const judge0LangId = LANGUAGE_IDS[lang];
  if (!judge0LangId)
    return { stdout: '', stderr: `No runner configured for "${lang}".`, isError: true };

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
  const useRapidAPI = Boolean(RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your_rapidapi_key_here');

  try {
    const submitUrl = useRapidAPI
      ? `${JUDGE0_URL}?base64_encoded=true&wait=true`
      : 'https://ce.judge0.com/submissions?base64_encoded=true&wait=true';

    const headers = useRapidAPI
      ? { 'Content-Type': 'application/json', 'x-rapidapi-host': 'judge0-ce.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY }
      : { 'Content-Type': 'application/json' };

    const payload = {
      language_id: judge0LangId,
      source_code: Buffer.from(source).toString('base64'),
      stdin: Buffer.from(stdin || '').toString('base64'),
    };

    const response = await fetch(submitUrl, { method: 'POST', headers, body: JSON.stringify(payload) });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Judge0 returned ${response.status}: ${text}`);
    }

    const data = await response.json();
    const decode = (s) => (s ? Buffer.from(s, 'base64').toString('utf-8') : '');

    const stdout         = decode(data.stdout);
    const stderr         = decode(data.stderr);
    const compile_output = decode(data.compile_output);
    const errorOutput    = [compile_output, stderr].filter(Boolean).join('\n');

    return {
      stdout,
      stderr: errorOutput,
      isError: Boolean(errorOutput.trim()) || (data.status?.id > 3),
      status: data.status?.description || '',
      time: data.time,
    };
  } catch (err) {
    return { stdout: '', stderr: `Execution error: ${err.message}`, isError: true };
  }
}

module.exports = { runUserCode };

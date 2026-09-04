const API_KEY = "AIzaSyAtkF3Otrj9rmmcYaAlp3YUd_qf923da9Q";

async function tryUrl(url, label) {
  console.log(`Testing ${label}...`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Hello! Reply with 'API is working'." }]
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(`-> ${label} failed with status ${response.status}:`, text);
      return false;
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(`-> SUCCESS on ${label}! Response:`, reply);
    return true;
  } catch (error) {
    console.log(`-> ${label} script error:`, error.message);
    return false;
  }
}

async function runTests() {
  // Test 1: gemini-2.5-flash
  const url1 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
  if (await tryUrl(url1, "gemini-2.5-flash")) return;

  // Test 2: gemini-flash-latest
  const url2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
  if (await tryUrl(url2, "gemini-flash-latest")) return;
}

runTests();

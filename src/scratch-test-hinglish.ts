import axios from 'axios';

async function testTranslate(text: string, sl: string) {
  const encodedText = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=en&dt=t&q=${encodedText}`;
  try {
    const response = await axios.get(url);
    const translatedText = response.data?.[0]?.[0]?.[0];
    console.log(`[sl=${sl}] "${text}" -> "${translatedText}"`);
  } catch (error: any) {
    console.error(`Error for "${text}" with sl=${sl}:`, error.message);
  }
}

async function run() {
  console.log('Testing "saban":');
  await testTranslate('saban', 'auto');
  await testTranslate('saban', 'hi');
  await testTranslate('saban', 'bn');

  console.log('\nTesting "kapde":');
  await testTranslate('kapde', 'auto');
  await testTranslate('kapde', 'hi');
  await testTranslate('kapde', 'bn');

  console.log('\nTesting "chaddi":');
  await testTranslate('chaddi', 'auto');
  await testTranslate('chaddi', 'hi');
  await testTranslate('chaddi', 'bn');
}

run();

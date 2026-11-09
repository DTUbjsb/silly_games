import { run } from './runner.js';

run().then(() => {
  document.getElementById('result').textContent = 'All game rules tests passed.';
}).catch((error) => {
  document.getElementById('result').textContent = `Game rules tests failed: ${error.stack}`;
  console.error(error);
});

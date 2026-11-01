// A small illustrative interaction, separate from the live learning module.
const send = document.querySelector('#stack-send');
const feedback = document.querySelector('#stack-feedback');
const playground = document.querySelector('.stack-playground');
const messages = [
  'Click the frontend. Follow the idea.',
  'The frontend sends a request to the backend.',
  'The backend saves the result as data.',
  'The frontend shows the result. Full circle.'
];
const actions = ['Give it a click', 'Send it to data', 'Show the result', 'Try it again'];
let step = 0;
send.hidden = false;
send.addEventListener('click', () => {
  step = (step + 1) % messages.length;
  playground.dataset.step = String(step);
  feedback.textContent = messages[step];
  send.firstChild.textContent = `${actions[step]} `;
});

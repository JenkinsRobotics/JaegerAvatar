'use strict';
// This is a local illustration. No model, microphone, camera or agent is connected.
document.documentElement.classList.add('js');
const stage = document.querySelector('.character-stage');
const controls = [...document.querySelectorAll('button[data-expression]')];
const status = document.querySelector('#preview-status');
const gaze = document.querySelector('#gaze');
for (const button of controls) {
  button.addEventListener('click', () => {
    stage.dataset.expression = button.dataset.expression;
    for (const control of controls) control.setAttribute('aria-pressed', String(control === button));
    status.textContent = `${button.textContent} expression · illustration only · no AI connected`;
  });
}
gaze.addEventListener('input', () => {
  const value = Number(gaze.value);
  stage.style.setProperty('--gaze', `${value * 0.12}px`);
  gaze.setAttribute('aria-valuetext', value === 0 ? 'Centered' : `${Math.abs(value)} percent ${value < 0 ? 'left' : 'right'}`);
});

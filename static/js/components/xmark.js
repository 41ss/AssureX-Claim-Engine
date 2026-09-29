/**
 * xmark.js — the large X from the ASSUREX wordmark that sits behind the pages.
 *
 * Two thick bars cross at the centre of a tall frame. The bars are longer than
 * the screen is tall, so the top and bottom of the screen cut their ends flat,
 * which gives the letterform shape. CSS sizes it to the full height of the page
 * area and sets it off one side, so part of it runs off the edge.
 */

const WIDTH = 820;
const HEIGHT = 1000;
const ANGLE = 59;          // bar angle from horizontal: the bars reach the top and bottom edges inside the frame

/** variant names the placement in CSS: "app" (behind every signed-in page) or "login". */
export function xmarkSvg(variant) {
  const bar = `<rect x="${WIDTH / 2 - 1200}" y="${HEIGHT / 2 - 95}" width="2400" height="190"></rect>`;
  return `
    <svg class="xmark xmark--${variant}" aria-hidden="true" focusable="false" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <g class="xmark__shape">
        <g class="xmark__bar" transform="rotate(${ANGLE} ${WIDTH / 2} ${HEIGHT / 2})">${bar}</g>
        <g class="xmark__bar" transform="rotate(${-ANGLE} ${WIDTH / 2} ${HEIGHT / 2})">${bar}</g>
      </g>
    </svg>`;
}

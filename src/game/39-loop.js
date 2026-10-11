/* ================= LOOP ================= */
let last = performance.now(), gameT = last / 1000;      // game time runs slow during slow motion (SLOWMO)
function frame(now) {
  requestAnimationFrame(frame);                         // queued first: one bad frame must never stop the game
  const rdt = clamp((now - last) / 1000, 0, 0.05), k = Math.min(slowStep(rdt), swapStep(rdt)), dt = rdt * k, run = !credits && !setOpen && !coopPaused(); timeK = k; last = now; if (run) gameT += dt;
  try { if (run) update(dt, gameT); render(gameT); }   // the credits, settings and co-op screens pause the game
  catch (e) { if (!frame.errs) frame.errs = 0; if (frame.errs++ < 5) console.error(e); }
}
civs = makeCivs();                                      // the first map's bystanders (later maps get theirs in resetGame)
EXIT = mkExit();                                        // ...and the exit, now its vehicle exists
p.side = freshSide(); p.hol = { a: 0, v: 0, pvx: 0, pvy: 0 };   // the Glock in its holster
allies.push(makeAlly());                                // your teammate
if (MAP.id === 'house') allyOffDuty(allies[0]);          // ...off duty on the sofa at home
coopFromLink();                                         // opened from a host's co-op QR code: join
requestAnimationFrame(frame);

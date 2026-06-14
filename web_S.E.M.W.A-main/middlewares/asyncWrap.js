// asyncWrap.js — évite les try/catch répétés dans chaque controller
export const asyncWrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
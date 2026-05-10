import pool from '../config/db.js';

const Event = {
async findEvent(filter) {
  const { keyword, city, date } = filter;

  const conditions = [];
  const values = [];
  let index = 1;

  if (keyword) {
    conditions.push(`(
      e.title ILIKE $${index}
      OR e.description ILIKE $${index}
      OR e.location ILIKE $${index}
      OR e.city ILIKE $${index}
    )`);
    values.push(`%${keyword}%`);
    index++;
  }

  if (city) {
    conditions.push(`e.city ILIKE $${index}`);
    values.push(`%${city}%`);
    index++;
  }

  if (date) {
    conditions.push(`DATE(e.start_date) = $${index}`);
    values.push(date);
    index++;
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.title,
      e.description,
      e.location,
      e.city,
      e.start_date,
      e.end_date,
      e.status,
      e.max_participants
    FROM public.events e
    ${whereClause}
    ORDER BY e.start_date ASC
    `,
    values
  );

  return rows;
}
};

export default Event;
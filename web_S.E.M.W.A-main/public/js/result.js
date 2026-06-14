
const params = new URLSearchParams(window.location.search);

const keyword = params.get('keyword');
const city = params.get('city');
const date = params.get('date');

console.log(keyword, city, date);
async function loadResults() {
  const params = new URLSearchParams(window.location.search);

  const keyword ='';
  const city = params.get('city');
  const date = params.get('date');

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      keyword,
      city,
      date,
    })
  });

  const data = await res.json();
console.log(data)
}

loadResults();
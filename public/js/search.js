
async function searchquest() {
    const keyword = document.getElementById('search-input').value;
    const city = document.getElementById('city').value;
    const date = document.getElementById('date').value;
    const type = document.getElementById('type').value;

  const dataToSend = {
    keyword: keyword,
    city: city,
    date: date
  };

  console.log(dataToSend);    
     const res = await fetch('/api/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify(
    dataToSend
  )
});
 const data = await res.json();
 console.log(data)
 display(data)
}
function display(data) {
  const container = document.getElementById('messages');

  // vider l'ancien résultat
  container.innerHTML = '';

  // si aucun événement trouvé
  if (!data || data.length === 0) {
    container.innerHTML = '<p>Aucun événement trouvé.</p>';
    return;
  }

  // afficher chaque événement
  data.forEach(event => {
    const card = document.createElement('div');
    card.classList.add('event-card');

    card.innerHTML = `
      <h3>${event.title}</h3>
      <p><strong>Lieu :</strong> ${event.location || 'Non précisé'}</p>
      <p><strong>Ville :</strong> ${event.city || 'Non précisée'}</p>
      <p><strong>Date :</strong> ${formatDate(event.start_date)}</p>
      <p><strong>Description :</strong> ${event.description || 'Pas de description'}</p>
      <p><strong>Status :</strong> ${event.status}</p>
    `;
    card.addEventListener('click',()=>{
        goToResultsPage(event.city,event.start_date)
    })
    container.appendChild(card);
  });
}

function formatDate(dateString) {
  if (!dateString) return 'Date non précisée';

  const date = new Date(dateString);

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
function filter() {
  const div = document.getElementById('dis-filter');

  if (div.style.display === 'none') {
    div.style.display = 'block';
  } else {
    div.style.display = 'none';
  }
}
function goToResultsPage(city,date) {


  window.location.href = `/result?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`;
}
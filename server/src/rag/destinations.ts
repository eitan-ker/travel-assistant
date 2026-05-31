export const DESTINATIONS = [
  // Top cities
  'Tokyo', 'Paris', 'London', 'New York City', 'Dubai', 'Singapore', 'Bangkok',
  'Barcelona', 'Amsterdam', 'Rome', 'Istanbul', 'Prague', 'Vienna', 'Lisbon',
  'Bali', 'Sydney', 'Los Angeles', 'Miami', 'Berlin', 'Tokyo', 'Seoul',
  'Hong Kong', 'Kuala Lumpur', 'Mumbai', 'Cape Town', 'Cairo', 'Athens',
  'Budapest', 'Kyoto', 'Marrakech', 'Buenos Aires', 'Rio de Janeiro',
  'Mexico City', 'Toronto', 'Vancouver', 'Dublin', 'Edinburgh', 'Copenhagen',
  'Stockholm', 'Oslo', 'Helsinki', 'Zurich', 'Geneva', 'Brussels', 'Warsaw',
  'Krakow', 'Dubrovnik', 'Santorini', 'Mykonos', 'Florence', 'Venice',
  'Milan', 'Madrid', 'Seville', 'Porto', 'Lagos', 'Reykjavik', 'Tallinn',
  'Riga', 'Vilnius', 'Bratislava', 'Ljubljana', 'Sarajevo', 'Kotor',
  'Tirana', 'Tbilisi', 'Yerevan', 'Baku', 'Almaty', 'Tashkent',
  'Kathmandu', 'Colombo', 'Dhaka', 'Yangon', 'Phnom Penh', 'Vientiane',
  'Hanoi', 'Ho Chi Minh City', 'Taipei', 'Manila', 'Jakarta', 'Surabaya',
  'Nairobi', 'Addis Ababa', 'Dar es Salaam', 'Accra', 'Lagos', 'Casablanca',
  'Tunis', 'Algiers', 'Johannesburg', 'Durban', 'Kampala', 'Kigali',
  'Doha', 'Abu Dhabi', 'Muscat', 'Amman', 'Beirut', 'Tel Aviv', 'Jerusalem',
  'Baghdad', 'Tehran', 'Karachi', 'Lahore', 'Islamabad', 'New Delhi',
  'Jaipur', 'Agra', 'Chennai', 'Bengaluru', 'Kolkata',

  // Top countries (for country-level queries)
  'Japan', 'France', 'Italy', 'Spain', 'Greece', 'Thailand', 'Indonesia',
  'Portugal', 'Morocco', 'Turkey', 'Egypt', 'India', 'Mexico', 'Brazil',
  'Argentina', 'Peru', 'Colombia', 'Vietnam', 'Cambodia', 'Nepal',
  'Iceland', 'Norway', 'Sweden', 'Denmark', 'Netherlands', 'Switzerland',
  'Austria', 'Czech Republic', 'Hungary', 'Poland', 'Croatia', 'Montenegro',
  'Georgia', 'Sri Lanka', 'Philippines', 'Malaysia', 'South Korea',
  'Taiwan', 'New Zealand', 'Australia', 'South Africa', 'Kenya', 'Tanzania',
  'Rwanda', 'Ethiopia', 'Ghana', 'Jordan', 'Israel', 'UAE', 'Oman',
  'Cuba', 'Costa Rica', 'Panama', 'Ecuador', 'Bolivia', 'Chile', 'Uruguay',
];

// Deduplicate
export const UNIQUE_DESTINATIONS = [...new Set(DESTINATIONS)];

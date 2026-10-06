// Demo category photos from Unsplash (free for commercial use under the Unsplash License),
// keyed by category name. Served straight from the Unsplash CDN.
const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

module.exports = {
  Beds: unsplash('photo-1578683010236-d716f9a3f461'),
  Sofas: unsplash('photo-1762803841422-5b8cf8767cd9'),
  Chairs: unsplash('photo-1617582907226-c49e2d8200d9'),
  Tables: unsplash('photo-1559662780-33af019fd570'),
  Wardrobes: unsplash('photo-1738229115082-b5647ffb3503'),
  Cabinets: unsplash('photo-1622372738946-62e02505feb3'),
  'Office Furniture': unsplash('photo-1706689656095-168768dc20a5'),
  'Dining Furniture': unsplash('photo-1616048056617-93b94a339009'),
  'TV Stands': unsplash('photo-1724582586470-85422853ad61'),
  'Custom Furniture': unsplash('photo-1590880795696-20c7dfadacde'),
  Other: unsplash('photo-1543248939-4296e1fea89b'),
};

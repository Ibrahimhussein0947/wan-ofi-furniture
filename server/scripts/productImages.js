// Demo product photos from Unsplash (free for commercial use under the Unsplash License),
// keyed by SKU: the product shot first, then a photo of it styled in a room.
// Served straight from the Unsplash CDN, resized to a card-friendly width.
const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

module.exports = {
  'BED-LAL-K': [unsplash('photo-1616594039964-ae9021a400a0'), unsplash('photo-1757344454333-cc666252e596')],
  'BED-SIM-Q': [unsplash('photo-1616594092403-fb65629b0a46'), unsplash('photo-1750420556288-d0e32a6f517b')],
  'SOF-RDS-3': [unsplash('photo-1606744888344-493238951221'), unsplash('photo-1759722665629-29df6ee4f9a5')],
  'SOF-ORO-L': [unsplash('photo-1605365070248-299a182a2ca6'), unsplash('photo-1759722668102-0d43a5696411')],
  'CHR-HAR': [unsplash('photo-1506898667547-42e22a46e125'), unsplash('photo-1634148737510-727f137375e0')],
  'CHR-MEK': [unsplash('photo-1598300042247-d088f8ab3a91'), unsplash('photo-1758977403341-0104135995af')],
  'TBL-AWA-C': [unsplash('photo-1724582586580-8b52c02e99dd'), unsplash('photo-1581428982868-e410dd047a90')],
  'TBL-HAW-S': [unsplash('photo-1781888677704-5efc689c0de3'), unsplash('photo-1759448867521-08b5f26d32bc')],
  'WRD-AXU-3': [unsplash('photo-1672137233327-37b0c1049e77'), unsplash('photo-1722349674028-a148f4364e43')],
  'CAB-GON': [unsplash('photo-1600422086908-72be2c8f5f3f'), unsplash('photo-1659398652648-b3b8b7c1beab')],
  'OFF-EXE-D': [unsplash('photo-1704655295066-681e61ecca6b'), unsplash('photo-1767786330387-5cef0327b6c1')],
  'OFF-ERG-C': [unsplash('photo-1688578735972-b61ec274df7b'), unsplash('photo-1688578735352-9a6f2ac3b70a')],
  'DIN-BDR-6': [unsplash('photo-1658280024253-34cafdfbb002'), unsplash('photo-1758977404683-d04c315a005b')],
  'DIN-JIM-S': [unsplash('photo-1718524767499-7fe3a6ab4f8c'), unsplash('photo-1628152371231-936cf45eb8f3')],
  'TV-ADA-180': [unsplash('photo-1633604712918-6ab1173d0ecd'), unsplash('photo-1698673786592-cd5730baf7d7')],
  'OTH-KON-B': [unsplash('photo-1603745676022-d1b77e3cbce8'), unsplash('photo-1594620302200-9a762244a156')],
};

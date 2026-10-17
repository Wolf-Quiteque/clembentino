// Seat sectors of the Aprenda & Empreenda com Elas venue.
// Shared by the API (Node) and the admin/invite pages (browser, as an ES module).
// Free-invite tickets ignore stock: every sector can be offered by the admin.
export const SEATS = [
  { id: 'frente-central', name: 'Frente Central', color: 'pw', img: 'assets/seat-front-center.jpg' },
  { id: 'frente-lateral', name: 'Frente Lateral Direita e Esquerda', color: 'pb', img: 'assets/seat-front-right.jpg' },
  { id: 'centro-1', name: 'Centro 1', color: 'pw', img: 'assets/seat-center-1.jpg' },
  { id: 'centro-lateral', name: 'Centro Lateral Direito e Esquerdo', color: 'pb', img: 'assets/seat-back-right-soldout.jpg' },
  { id: 'traseiro-lateral', name: 'Traseiro Lateral Direito e Esquerdo', color: 'pb', img: 'assets/seat-back-right-1.jpg' },
  { id: 'centro-traseiro-1', name: 'Centro Traseiro 1', color: 'pb', img: 'assets/seat-center-back-1.jpg' },
  { id: 'centro-traseiro', name: 'Centro Traseiro 2', color: 'pw', img: 'assets/seat-center-back-2.jpg' },
  { id: 'traseiro-lateral-3', name: 'Traseiro Lateral Esquerdo e Direito', color: 'pw', img: 'assets/seat-back-left-3.jpg' },
  { id: 'traseiro-frente', name: 'Traseiro Frente', color: 'pb', img: 'assets/seat-back-front-soldout.jpg' },
];

// Seat colour codes used on the venue map: Pink White / Pink Black.
export const SEAT_COLORS = { pw: 'Pink White', pb: 'Pink Black' };

export const seatById = id => SEATS.find(s => s.id === id);

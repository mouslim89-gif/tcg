import { Route, Routes } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Home } from './pages/Home';
import { Packs } from './pages/Packs';
import { Collection } from './pages/Collection';
import { CardDetail } from './pages/CardDetail';
import { Battle } from './pages/Battle';
import { Credits } from './pages/Credits';
import { Deck } from './pages/Deck';
import { Words } from './pages/Words';

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/packs" element={<Packs />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/card/:id" element={<CardDetail />} />
        <Route path="/battle" element={<Battle />} />
        <Route path="/deck" element={<Deck />} />
        <Route path="/words" element={<Words />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

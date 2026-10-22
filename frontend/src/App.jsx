import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { INICIO, SesionProvider, useSesion } from './sesion';
import { AccesibilidadProvider, usePantalla } from './accesibilidad';
import { Confirmar, Login, Registro } from './pages/Acceso';
import { MisCitas, Reservar } from './pages/Paciente';
import { AgendaRecepcion, NuevaCita } from './pages/Recepcion';
import { AgendaMedico } from './pages/Medico';
import { Especialidades, Horarios, Medicos, Reportes } from './pages/Admin';

// RF02: cada rol ve solo sus opciones
const MENU = {
  paciente: [['/paciente/reservar', 'Reservar cita'], ['/paciente/citas', 'Mis citas']],
  recepcionista: [['/recepcion', 'Citas del día'], ['/recepcion/nueva', 'Agendar cita']],
  medico: [['/medico', 'Mi agenda']],
  administrador: [['/admin/especialidades', 'Especialidades'], ['/admin/medicos', 'Médicos'], ['/admin/horarios', 'Horarios'], ['/admin/reportes', 'Resumen mensual']],
};
const ROL = { paciente: 'Paciente', recepcionista: 'Recepción', medico: 'Médico', administrador: 'Administración' };

// Cada vez que cambia la pantalla se avisa al lector de pantalla y se lleva el foco al título
function CambioPantalla() {
  const loc = useLocation();
  const anunciar = usePantalla();
  useEffect(() => { anunciar(loc.pathname); }, [loc.pathname]);
  return null;
}

function Marco({ rol }) {
  const { usuario, salir } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const loc = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;
  if (usuario.rol !== rol) return <Navigate to={INICIO[usuario.rol]} replace />;
  return (
    <div className="app">
      <header className="barra-movil">
        <div className="logo"><span className="cruz" aria-hidden="true">+</span>MediCita</div>
        <button className="btn chico" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-controls="menu-lateral" aria-label="Menú">☰</button>
      </header>
      <aside className={`lateral ${abierto ? 'abierto' : ''}`} id="menu-lateral">
        <div className="logo"><span className="cruz" aria-hidden="true">+</span>MediCita</div>
        <span className="rol">{ROL[usuario.rol]}</span>
        <nav aria-label="Menú principal">
          {MENU[usuario.rol].map(([to, t]) => (
            <NavLink key={to} to={to} end onClick={() => setAbierto(false)}>{t}</NavLink>
          ))}
        </nav>
        <div className="quien">
          <span className="avatar" aria-hidden="true">{usuario.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
          <div><b>{usuario.nombre}</b><small>{usuario.correo}</small></div>
        </div>
        <button className="btn texto salir" onClick={() => salir()}>Cerrar sesión</button>
      </aside>
      <main className="contenido" id="contenido"><Outlet /></main>
    </div>
  );
}

function Inicio() {
  const { usuario } = useSesion();
  return <Navigate to={usuario ? INICIO[usuario.rol] : '/login'} replace />;
}

export default function App() {
  return (
    <AccesibilidadProvider>
    <SesionProvider>
      <BrowserRouter>
        <a href="#contenido" className="saltar">Saltar al contenido principal</a>
        <CambioPantalla />
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/confirmar/:token" element={<Confirmar />} />
          <Route element={<Marco rol="paciente" />}>
            <Route path="/paciente/reservar" element={<Reservar />} />
            <Route path="/paciente/citas" element={<MisCitas />} />
          </Route>
          <Route element={<Marco rol="recepcionista" />}>
            <Route path="/recepcion" element={<AgendaRecepcion />} />
            <Route path="/recepcion/nueva" element={<NuevaCita />} />
          </Route>
          <Route element={<Marco rol="medico" />}>
            <Route path="/medico" element={<AgendaMedico />} />
          </Route>
          <Route element={<Marco rol="administrador" />}>
            <Route path="/admin/especialidades" element={<Especialidades />} />
            <Route path="/admin/medicos" element={<Medicos />} />
            <Route path="/admin/horarios" element={<Horarios />} />
            <Route path="/admin/reportes" element={<Reportes />} />
          </Route>
          <Route path="*" element={<Inicio />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
    </AccesibilidadProvider>
  );
}

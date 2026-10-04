import { Header } from './components/Header'
import { LargeListDemo } from './demos/large-list/LargeListDemo'

export default function App() {
  return (
    <>
      <Header />
      <main>
        <LargeListDemo />
      </main>
      <footer className="border-t border-slate-900 py-8 text-center text-sm text-slate-500">
        WebOpt Lab · all data is generated in your browser. No server involved.
      </footer>
    </>
  )
}

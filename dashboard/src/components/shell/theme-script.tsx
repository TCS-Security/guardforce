/** Applies the stored theme before paint to avoid a flash. */
export function ThemeScript() {
  const code = `try{if(localStorage.getItem('gf-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

import './PageLoader.css';

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Cargando">
      <img src="/images/loader-apc.svg" alt="" />
    </div>
  );
}

export default PageLoader;

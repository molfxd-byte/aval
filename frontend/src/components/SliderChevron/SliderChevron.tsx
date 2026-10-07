interface SliderChevronProps {
  direction: 'left' | 'right';
}

const PATHS = {
  left: 'M13.293 6.293 7.586 12l5.707 5.707 1.414-1.414L10.414 12l4.293-4.293z',
  right: 'M10.707 17.707 16.414 12l-5.707-5.707-1.414 1.414L13.586 12l-4.293 4.293z',
};

function SliderChevron({ direction }: SliderChevronProps) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
      <path d={PATHS[direction]} />
    </svg>
  );
}

export default SliderChevron;

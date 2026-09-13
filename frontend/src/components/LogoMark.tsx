import logoMark from '../assets/logo-mark.svg';

export default function LogoMark({ size = 43 }: { size?: number }) {
  return <img src={logoMark} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />;
}

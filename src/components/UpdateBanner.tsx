import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (needRefresh) setShow(true);
  }, [needRefresh]);

  if (!show) return null;

  return (
    <div className="update-banner" role="status" dir="rtl">
      <span>גרסה חדשה זמינה</span>
      <button
        type="button"
        className="primary-action pressable"
        onClick={() => {
          void updateServiceWorker(true);
          setNeedRefresh(false);
          setShow(false);
        }}
      >
        עדכן עכשיו
      </button>
      <button
        type="button"
        className="secondary-action pressable"
        onClick={() => {
          setNeedRefresh(false);
          setShow(false);
        }}
      >
        אחר כך
      </button>
    </div>
  );
}

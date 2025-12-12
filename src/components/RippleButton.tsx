// components/RippleButton.tsx
import { useRef } from "react";
import type { ReactNode } from "react";

export default function RippleButton({
    onClick,
    className = "",
    children,
}: {
    onClick?: () => void;
    className?: string;
    children: ReactNode;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);

    const createRipple = (event: React.MouseEvent) => {
        const button = btnRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    };

    return (
        <button
            ref={btnRef}
            onClick={(e) => {
                createRipple(e);
                onClick?.();
            }}
            className={
                `relative overflow-hidden 
                 px-3 py-2 rounded-xl text-white 
                 shadow-md hover:shadow-lg active:scale-95 
                 transition-all duration-150 
                ` + className
            }
        >
            {children}
        </button>
    );
}


declare module 'framer-motion' {
    import * as React from 'react';

    export interface AnimatePresenceProps {
        children?: React.ReactNode;
        initial?: boolean;
        mode?: 'sync' | 'popLayout' | 'wait';
        onExitComplete?: () => void;
    }

    export const AnimatePresence: React.FC<AnimatePresenceProps>;

    export interface MotionProps extends React.HTMLAttributes<any> {
        initial?: any;
        animate?: any;
        exit?: any;
        transition?: any;
        variants?: any;
        style?: any;
        layout?: boolean | "position" | "size";
        layoutId?: string;
        onMouseEnter?: React.MouseEventHandler;
        onMouseLeave?: React.MouseEventHandler;
    }

    export const motion: {
        div: React.FC<MotionProps & React.RefAttributes<HTMLDivElement>>;
        button: React.FC<MotionProps & React.RefAttributes<HTMLButtonElement>>;
        span: React.FC<MotionProps & React.RefAttributes<HTMLSpanElement>>;
        p: React.FC<MotionProps & React.RefAttributes<HTMLParagraphElement>>;
        a: React.FC<MotionProps & React.RefAttributes<HTMLAnchorElement>>;
        ul: React.FC<MotionProps & React.RefAttributes<HTMLUListElement>>;
        li: React.FC<MotionProps & React.RefAttributes<HTMLLIElement>>;
        img: React.FC<MotionProps & React.RefAttributes<HTMLImageElement>>;
        // Add more as needed
        [key: string]: React.FC<MotionProps>;
    };
}

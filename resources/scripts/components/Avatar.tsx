import React, { useMemo } from 'react';
import BoringAvatar, { AvatarProps } from 'boring-avatars';
import { useStoreState } from '@/state/hooks';
import md5 from 'md5';

const palette = ['#FFAD08', '#EDD75A', '#73B06F', '#0C8F8F', '#587291'];

type Props = Omit<AvatarProps, 'colors'>;

interface UserAvatarProps {
    variant?: Props['variant'];
    size?: Props['size'];
    square?: Props['square'];
    className?: string;
    style?: React.CSSProperties;
}

const _Avatar = ({ variant = 'beam', ...props }: AvatarProps) => (
    <BoringAvatar colors={palette} variant={variant} {...props} />
);

const _UserAvatar = ({ variant = 'beam', className, style, size, square }: UserAvatarProps) => {
    const email = useStoreState((state) => state.user.data?.email?.trim().toLowerCase() ?? null);
    const fallbackName = useStoreState((state) => state.user.data?.uuid || 'system');
    const classes = className ? `userAvatar ${className}` : 'userAvatar';

    const hash = useMemo(() => {
        if (!email) {
            return null;
        }

        try {
            return md5(email);
        } catch (error) {
            console.warn(error);
            return null;
        }
    }, [email]);

    if (!hash) {
        return (
            <div className={classes} style={style}>
                <BoringAvatar colors={palette} name={fallbackName} variant={variant} size={size} square={square} />
            </div>
        );
    }

    const avatarUrl = `https://www.gravatar.com/avatar/${hash}?s=512`;

    return (
        <div
            className={classes}
            style={{
                background: `url('${avatarUrl}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                ...style,
            }}
        />
    );
};

_Avatar.displayName = 'Avatar';
_UserAvatar.displayName = 'Avatar.User';

const Avatar = Object.assign(_Avatar, {
    User: _UserAvatar,
});

export default Avatar;

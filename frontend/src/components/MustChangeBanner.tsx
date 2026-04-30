interface Props {
  onChangeClick: () => void;
}

export const MustChangeBanner = ({ onChangeClick }: Props) => (
  <div className="bg-yellow-500/20 border-b border-yellow-500/40 text-yellow-100 px-4 py-2 flex items-center justify-between">
    <span className="text-sm">
      You're using a temporary password. Change it now.
    </span>
    <button
      onClick={onChangeClick}
      className="px-3 py-1 rounded bg-yellow-500 text-gray-900 hover:bg-yellow-400 text-sm font-medium"
    >
      Change password
    </button>
  </div>
);

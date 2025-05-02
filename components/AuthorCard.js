import React from 'react';
import Image from 'next/image';

const AuthorCard = ({ profile }) => {
  if (!profile) return null;

  return (
    <div className="profile-card">
      {profile.photo ? (
        <Image
         src={profile.photo}
          alt={profile.name} className="profile-image"
        />
      ) : (
        <div className="profile-image-placeholder">
          {profile.name ? profile.name.charAt(0) : '?'}
        </div>
      )}
      <div>
        <h2>{profile.name}</h2>
        <p>{profile.affiliation}</p>
        {profile.h_index && profile.i10_index && (
          <p>
            <small>h-index: {profile.h_index}, i10-index: {profile.i10_index}</small>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthorCard;
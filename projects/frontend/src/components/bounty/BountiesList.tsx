import React, { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { getBountiesByCreator, StoredBounty } from '@/utils/bountyStorage';
import { Award, User, DollarSign, Zap } from 'lucide-react';

interface BountiesListProps {
  refreshTrigger?: number;
}

const BountiesList: React.FC<BountiesListProps> = ({ refreshTrigger = 0 }) => {
  const { activeAddress } = useWallet();
  const [bounties, setBounties] = useState<StoredBounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeAddress) {
      setLoading(true);
      console.log('📋 BountiesList loading for:', activeAddress);
      const userBounties = getBountiesByCreator(activeAddress);
      console.log('📋 Found bounties:', userBounties);
      setBounties(userBounties);
      setLoading(false);
    }
  }, [activeAddress, refreshTrigger]);

  if (!activeAddress) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Connect your wallet to see your bounties</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading bounties...</p>
      </div>
    );
  }

  if (bounties.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-600">No bounties created yet</p>
        <p className="text-sm text-gray-500 mt-2">Create your first bounty to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Bounties</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bounties.map((bounty) => (
          <div
            key={bounty.appId}
            className="card bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg border border-purple-200 hover:shadow-xl transition-shadow"
          >
            <div className="card-body">
              {/* Title and Status */}
              <div className="flex justify-between items-start mb-2">
                <h3 className="card-title text-lg text-gray-900">{bounty.title}</h3>
                <span className={`badge ${
                  bounty.status === 'active'
                    ? 'badge-success'
                    : bounty.status === 'claimed'
                    ? 'badge-warning'
                    : 'badge-info'
                }`}>
                  {bounty.status}
                </span>
              </div>

              {/* Description */}
              <p className="text-gray-700 text-sm mb-4">{bounty.description}</p>

              {/* Metadata */}
              <div className="space-y-2 text-sm">
                {/* Reward */}
                <div className="flex items-center gap-2 text-gray-700">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-semibold">{bounty.reward} ALGO</span>
                </div>

                {/* Difficulty */}
                <div className="flex items-center gap-2 text-gray-700">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span className="capitalize">{bounty.difficulty}</span>
                </div>

                {/* Category */}
                <div className="flex items-center gap-2 text-gray-600 text-xs">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                    {bounty.category}
                  </span>
                </div>

                {/* App ID */}
                <div className="text-xs text-gray-500 break-all font-mono">
                  App ID:{' '}
                  <a
                    href={`https://testnet.explorer.perawallet.app/application/${bounty.appId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {bounty.appId}
                  </a>
                </div>
              </div>

              {/* Created Date */}
              <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
                Created {new Date(bounty.createdAt).toLocaleDateString()}
              </div>

              {/* Actions */}
              <div className="card-actions justify-end mt-4">
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    navigator.clipboard.writeText(bounty.appAddress);
                    alert('App address copied!');
                  }}
                >
                  Copy Address
                </button>
                <a
                  href={`https://testnet.algoexplorer.io/application/${bounty.appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-primary"
                >
                  View on Explorer
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BountiesList;

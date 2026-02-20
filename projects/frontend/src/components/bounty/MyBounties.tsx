import React, { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { getBountiesByCreator, StoredBounty } from '@/utils/bountyStorage';
import { Award, ExternalLink, Copy, Trash2 } from 'lucide-react';

interface MyBountiesProps {
  refreshTrigger?: number;
}

const MyBounties: React.FC<MyBountiesProps> = ({ refreshTrigger = 0 }) => {
  console.log('🎯 MyBounties component rendering! refreshTrigger:', refreshTrigger);
  
  const { activeAddress } = useWallet();
  const [bounties, setBounties] = useState<StoredBounty[]>([]);

  // FORCE: Load bounties directly from localStorage on every render
  const directBounties = activeAddress ? getBountiesByCreator(activeAddress) : [];
  console.log('🔥 DIRECT LOAD from localStorage:', directBounties.length, directBounties);

  useEffect(() => {
    console.log('🌟 MyBounties useEffect triggered');
    console.log('   activeAddress:', activeAddress);
    console.log('   refreshTrigger:', refreshTrigger);
    
    if (!activeAddress) {
      console.log('   ⚠️ No active address, clearing bounties');
      setBounties([]);
      return;
    }

    console.log('🔍 Fetching bounties for:', activeAddress);
    const allBounties = getBountiesByCreator(activeAddress);
    console.log('✅ Found bounties:', allBounties.length, allBounties);
    setBounties(allBounties);
  }, [activeAddress, refreshTrigger]);

  console.log('🎨 Rendering MyBounties with', bounties.length, 'bounties. State:', bounties);

  // Use directBounties for rendering to bypass state issues
  const bounciesToRender = directBounties.length > 0 ? directBounties : bounties;
  console.log('📊 Will render:', bounciesToRender.length, 'bounties');

  if (!activeAddress) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-8 border-2 border-dashed border-yellow-300">
        <div className="flex items-center gap-3 mb-4">
          <Award className="h-6 w-6 text-yellow-600" />
          <h2 className="text-xl font-bold text-yellow-800">My Bounties</h2>
        </div>
        <p className="text-yellow-700">Connect your wallet to view your bounties</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 border-2 border-purple-200">
      {/* DEBUG: This should always be visible */}
      <div className="bg-red-500 text-white p-4 mb-4 text-center font-bold">
        🚨 MY BOUNTIES COMPONENT IS LOADED! Bounties: {bounciesToRender.length}
      </div>
      
      <div className="flex items-center gap-3 mb-6">
        <Award className="h-6 w-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-purple-900">My Bounties ({bounciesToRender.length})</h2>
      </div>

      {bounciesToRender.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-2">No bounties yet</p>
          <p className="text-sm text-gray-500">Click "+ Create Bounty" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bounciesToRender.map((bounty) => (
            <div
              key={bounty.appId}
              className="bg-white rounded-lg p-4 shadow-md border-l-4 border-purple-500 hover:shadow-lg transition-shadow"
            >
              {/* Title and Status */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{bounty.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{bounty.description}</p>
                </div>
                <span
                  className={`ml-4 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    bounty.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : bounty.status === 'claimed'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {bounty.status.toUpperCase()}
                </span>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 py-3 bg-gray-50 rounded px-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Reward</p>
                  <p className="text-lg font-bold text-green-600">{bounty.reward} ALGO</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Difficulty</p>
                  <p className="text-gray-900 capitalize font-medium">{bounty.difficulty}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Category</p>
                  <p className="text-gray-900 capitalize font-medium">{bounty.category}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">App ID</p>
                  <a
                    href={`https://testnet.explorer.perawallet.app/application/${bounty.appId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-900 font-mono text-sm hover:text-blue-600 hover:underline"
                  >
                    {bounty.appId}
                  </a>
                </div>
              </div>

              {/* App Address */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">App Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 text-gray-800 text-xs p-2 rounded font-mono truncate">
                    {bounty.appAddress}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(bounty.appAddress);
                      alert('Copied!');
                    }}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Copy address"
                  >
                    <Copy className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Created Date */}
              <p className="text-xs text-gray-500 mb-3">
                Created {new Date(bounty.createdAt).toLocaleString()}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <a
                  href={`https://testnet.algoexplorer.io/application/${bounty.appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Explorer
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBounties;

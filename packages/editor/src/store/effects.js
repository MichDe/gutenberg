/**
 * External dependencies
 */
import { last } from 'lodash';

/**
 * WordPress dependencies
 */
import {
	getBlockType,
	switchToBlockType,
	doBlocksMatchTemplate,
	synchronizeBlocksWithTemplate,
} from '@wordpress/blocks';
import { speak } from '@wordpress/a11y';

/**
 * Internal dependencies
 */
import {
	replaceBlocks,
	selectBlock,
	resetBlocks,
	setTemplateValidity,
} from './actions';
import {
	getBlock,
	getBlockRootClientId,
	getBlocks,
	getPreviousBlockClientId,
	getSelectedBlock,
	getTemplate,
	getTemplateLock,
	isValidTemplate,
} from './selectors';
import {
	fetchReusableBlocks,
	saveReusableBlocks,
	deleteReusableBlocks,
	convertBlockToReusable,
	convertBlockToStatic,
	receiveReusableBlocks,
} from './effects/reusable-blocks';
import {
	requestPostUpdate,
	requestPostUpdateSuccess,
	requestPostUpdateFailure,
	trashPost,
	trashPostFailure,
	refreshPost,
} from './effects/posts';

export default {
	REQUEST_POST_UPDATE: ( action, store ) => {
		requestPostUpdate( action, store );
	},
	REQUEST_POST_UPDATE_SUCCESS: requestPostUpdateSuccess,
	REQUEST_POST_UPDATE_FAILURE: requestPostUpdateFailure,
	TRASH_POST: ( action, store ) => {
		trashPost( action, store );
	},
	TRASH_POST_FAILURE: trashPostFailure,
	REFRESH_POST: ( action, store ) => {
		refreshPost( action, store );
	},
	MERGE_BLOCKS( action, store ) {
		const { dispatch } = store;
		const state = store.getState();
		const [ firstBlockClientId, secondBlockClientId ] = action.blocks;
		const blockA = getBlock( state, firstBlockClientId );
		const blockB = getBlock( state, secondBlockClientId );
		const blockType = getBlockType( blockA.name );

		// Only focus the previous block if it's not mergeable
		if ( ! blockType.merge ) {
			dispatch( selectBlock( blockA.clientId ) );
			return;
		}

		// We can only merge blocks with similar types
		// thus, we transform the block to merge first
		const blocksWithTheSameType = blockA.name === blockB.name ?
			[ blockB ] :
			switchToBlockType( blockB, blockA.name );

		// If the block types can not match, do nothing
		if ( ! blocksWithTheSameType || ! blocksWithTheSameType.length ) {
			return;
		}

		// Calling the merge to update the attributes and remove the block to be merged
		const updatedAttributes = blockType.merge(
			blockA.attributes,
			blocksWithTheSameType[ 0 ].attributes
		);

		dispatch( selectBlock( blockA.clientId, -1 ) );
		dispatch( replaceBlocks(
			[ blockA.clientId, blockB.clientId ],
			[
				{
					...blockA,
					attributes: {
						...blockA.attributes,
						...updatedAttributes,
					},
				},
				...blocksWithTheSameType.slice( 1 ),
			]
		) );
	},
	RESET_BLOCKS: [
		function validateBlocksToTemplate( action, store ) {
			const state = store.getState();
			const template = getTemplate( state );
			const templateLock = getTemplateLock( state );

			// Unlocked templates are considered always valid because they act
			// as default values only.
			const isBlocksValidToTemplate = (
				! template ||
				templateLock !== 'all' ||
				doBlocksMatchTemplate( getBlocks(), template )
			);

			// Update if validity has changed.
			if ( isBlocksValidToTemplate !== isValidTemplate( state ) ) {
				return setTemplateValidity( isBlocksValidToTemplate );
			}
		},
	],
	SYNCHRONIZE_TEMPLATE( action, { getState } ) {
		const state = getState();
		const template = getTemplate( state );
		if ( ! template ) {
			return;
		}

		const blocks = getBlocks( state );
		const updatedBlockList = synchronizeBlocksWithTemplate( blocks, template );

		return [
			resetBlocks( updatedBlockList ),
			setTemplateValidity( true ),
		];
	},
	CHECK_TEMPLATE_VALIDITY( action, { getState } ) {
		const state = getState();
		const blocks = getBlocks( state );
		const template = getTemplate( state );
		const templateLock = getTemplateLock( state );
		const isValid = (
			! template ||
			templateLock !== 'all' ||
			doBlocksMatchTemplate( blocks, template )
		);

		return setTemplateValidity( isValid );
	},
	FETCH_REUSABLE_BLOCKS: ( action, store ) => {
		fetchReusableBlocks( action, store );
	},
	SAVE_REUSABLE_BLOCK: ( action, store ) => {
		saveReusableBlocks( action, store );
	},
	DELETE_REUSABLE_BLOCK: ( action, store ) => {
		deleteReusableBlocks( action, store );
	},
	RECEIVE_REUSABLE_BLOCKS: receiveReusableBlocks,
	CONVERT_BLOCK_TO_STATIC: convertBlockToStatic,
	CONVERT_BLOCK_TO_REUSABLE: convertBlockToReusable,
	CREATE_NOTICE( { notice: { content, spokenMessage } } ) {
		const message = spokenMessage || content;
		speak( message, 'assertive' );
	},
	REMOVE_BLOCKS( action, { getState, dispatch } ) {
		// if the action says previous block should not be selected don't do anything.
		if ( ! action.selectPrevious ) {
			return;
		}

		const firstRemovedBlockClientId = action.clientIds[ 0 ];
		const state = getState();
		const currentSelectedBlock = getSelectedBlock( state );

		// recreate the state before the block was removed.
		const previousState = { ...state, editor: { present: last( state.editor.past ) } };

		// rootClientId of the removed block.
		const rootClientId = getBlockRootClientId( previousState, firstRemovedBlockClientId );

		// Client ID of the block that was before the removed block or the
		// rootClientId if the removed block was first amongst its siblings.
		const blockClientIdToSelect = getPreviousBlockClientId( previousState, firstRemovedBlockClientId ) || rootClientId;

		// Dispatch select block action if the currently selected block
		// is not already the block we want to be selected.
		if ( blockClientIdToSelect !== currentSelectedBlock ) {
			dispatch( selectBlock( blockClientIdToSelect, -1 ) );
		}
	},
};

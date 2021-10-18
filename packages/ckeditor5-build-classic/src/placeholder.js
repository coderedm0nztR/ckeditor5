/* eslint-disable no-undef */
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { toWidget } from '@ckeditor/ckeditor5-widget/src/utils';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';
import Command from '@ckeditor/ckeditor5-core/src/command';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';

class Placeholder extends Plugin {
	static get requires() {
		return [ PlaceholderEditing, PlaceholderUI ];
	}
}

class PlaceholderCommand extends Command {
	execute( index ) {
		const editor = this.editor;
		const actions = editor.config.get( 'placeholderConfig.actions' );

		for ( let i = 0; i < actions.length; i++ ) {
			const action = actions[ i ];
			if ( i === index ) {
				if ( typeof action.callback == 'function' ) {
					action.callback( editor );
				}
			}
		}
	}

	refresh() {
		const model = this.editor.model;
		const actions = this.editor.config.get( 'placeholderConfig.actions' );
		const selection = model.document.selection;
		const allowedIn = !!actions && actions.length > 0 &&
			model.schema.findAllowedParent( selection.getFirstPosition(), actions[ 0 ].name );
		this.isEnabled = allowedIn != null;
	}
}

// The default feed callback.
function createPlaceholderCallback( feedItems ) {
	return feedText => {
		const filteredItems = feedItems
		// Make the default mention feed case-insensitive.
			.filter( item => {
				// Item might be defined as object.
				const itemId = typeof item == 'string' ? item : String( item.id );

				// The default feed is case insensitive.
				return itemId.toLowerCase().includes( feedText.toLowerCase() );
			} )
			// Do not return more than 10 items.
			.slice( 0, 10 );

		return filteredItems;
	};
}

class PlaceholderUI extends Plugin {
	init() {
		const editor = this.editor;
		const actions = editor.config.get( 'placeholderConfig.actions' );

		actions.forEach( ( action, index ) => {
			// The "placeholder" dropdown must be registered among the UI components of the editor
			// to be displayed in the toolbar.
			editor.ui.componentFactory.add( action.name, locale => {
				const view = new ButtonView( locale );
				view.set( {
					label: action.label,
					icon: action.logo,
					tooltip: true,
					withText: true
				} );

				// Disable the placeholder button when the command is disabled.
				const command = editor.commands.get( action.name );
				view.bind( 'isEnabled' ).to( command );

				// Execute the command when the dropdown item is clicked (executed).
				this.listenTo( view, 'execute', () => {
					editor.execute( action.name, index );
				} );

				return view;
			} );
		} );
	}
}

function defaultCallback( payload ) {
	console.log( 'default callback', payload );
}

class PlaceholderEditing extends Plugin {
	static get requires() {
		return [ Widget ];
	}

	init() {
		const actions = this.editor.config.get( 'placeholderConfig.actions' );
		this._defineSchema( actions );
		this._defineConverters( actions );
		this.editor.config.define( 'placeholderConfig', {
			callbackFn: defaultCallback
		} );

		actions.forEach( action => {
			this.editor.commands.add( action.name, new PlaceholderCommand( this.editor ) );
		} );
	}

	_defineSchema( actions ) {
		const schema = this.editor.model.schema;
		actions.forEach( action => {
			schema.register( action.name, {
				// Allow wherever text is allowed:
				allowWhere: '$text',

				// The placeholder will act as an inline node:
				isInline: true,

				// The inline widget can have the same attributes as text (for example linkHref, bold).
				allowAttributesOf: '$text',

				// The placeholder can have many types, like date, name, surname, etc:
				allowAttributes: [ 'id', 'value', 'class', 'name', 'url' ]
			} );
		} );
	}

	_defineConverters( actions ) {
		const conversion = this.editor.conversion;
		actions.forEach( action => {
			conversion.for( 'upcast' ).elementToElement( {
				view: {
					name: 'span',
					classes: [ 'mention' ]
				},
				model: action.name
			} );

			conversion.for( 'editingDowncast' ).elementToElement( {
				model: action.name,
				view: ( modelItem, { writer: viewWriter } ) => {
					const widgetElement = createPlaceholderView( modelItem, viewWriter, action.valueParam );

					// Enable widget handling on a placeholder element inside the editing view.
					return toWidget( widgetElement, viewWriter );
				}
			} );

			conversion.for( 'dataDowncast' ).elementToElement( {
				model: action.name,
				view: ( modelItem, { writer: viewWriter } ) => createPlaceholderView( modelItem, viewWriter, action.valueParam )
			} );
		} );

		// Helper method for both downcast converters.
		function createPlaceholderView( modelItem, viewWriter, valueParam ) {
			const id = modelItem.getAttribute( 'id' );
			const value = modelItem.getAttribute( 'value' );

			const additionalValueParams = {};
			if ( !!valueParam && valueParam !== '' ) {
				additionalValueParams[ valueParam ] = value;
			}

			const placeholderView = viewWriter.createContainerElement( 'span', {
				class: 'mention',
				id: value,
				value: id,
				...additionalValueParams
			}, {
				isAllowedInsideAttributeElement: true
			} );

			// Insert the placeholder name (as a text).
			const innerText = viewWriter.createText( id );
			viewWriter.insert( viewWriter.createPositionAt( placeholderView, 0 ), innerText );

			return placeholderView;
		}
	}
}

export default Placeholder;

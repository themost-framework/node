import {NodeDataContext, NodeDataService} from '../src';
import {EdmSchema} from '@themost/client';
import {getApplication, serveApplication, getServerAddress, getToken} from '@themost/test';
import {URL, URLSearchParams} from 'url';
import { Router } from 'express';
import { Server } from 'http';

const TEST_USER = 'alexis.rees@example.com';
const TEST_PASSWORD = 'secret';

describe('NodeDataContext', () => {
    let liveServer: Server;
    let server_uri: string;
    let app: any;
    beforeAll(async () => {
        app = getApplication();
        liveServer = await serveApplication(app);
        server_uri = getServerAddress(liveServer);
    });
    afterAll((done) => {
       if (liveServer) {
           liveServer.close(() => {
              return done();
           });
       }
    });
    it('should create instance', () => {
       const context = new NodeDataContext('/', {
           useMediaTypeExtensions: false,
           useResponseConversion: true
       });
       expect(context).toBeTruthy();
    });
    it('should use NodeDataContext.getBase()', () => {
        const context = new NodeDataContext('/', {
            useMediaTypeExtensions: false,
            useResponseConversion: true
        });
        expect(context.getBase()).toBe('/');
    });
    it('should use NodeDataContext.getService()', () => {
        const context = new NodeDataContext('/', {
            useMediaTypeExtensions: false,
            useResponseConversion: true
        });
        expect(context.getService()).toBeInstanceOf(NodeDataService);
    });
    it('should use NodeDataContext.getMetadata()', async () => {
        const context = new NodeDataContext( new URL('/api/', server_uri).toString(), {
            useMediaTypeExtensions: false,
            useResponseConversion: true
        });
        const token = await getToken(server_uri, TEST_USER, TEST_PASSWORD);
        context.setBearerAuthorization(token.access_token);
        const schema = await context.getMetadata();
        expect(schema).toBeTruthy();
        expect(schema).toBeInstanceOf(EdmSchema);
        expect(schema.EntityContainer.EntitySet.find( x => {
            return x.Name === 'Products';
        })).toBeTruthy();
    });
    it('should use NodeDataContext.model().getItems()', async () => {
        const context = new NodeDataContext( new URL('/api/', server_uri).toString(), {
            useMediaTypeExtensions: false,
            useResponseConversion: true
        });
        const token = await getToken(server_uri, TEST_USER, TEST_PASSWORD);
        context.setBearerAuthorization(token.access_token);
        const items = await context.model('Products').getItems();
        expect(items).toBeInstanceOf(Array);
        expect(items.length).toBeGreaterThan(0);
    });

    it('should use NodeDataContext.model().where()', async () => {
        const context = new NodeDataContext( new URL('/api/', server_uri).toString(), {
            useMediaTypeExtensions: false,
            useResponseConversion: true
        });
        const token = await getToken(server_uri, TEST_USER, TEST_PASSWORD);
        context.setBearerAuthorization(token.access_token);
        const items = await context.model('Products').where('category').equal('Laptops').getItems();
        expect(items).toBeInstanceOf(Array);
        expect(items.length).toBeGreaterThan(0);
        items.forEach( (item) => {
           expect(item.category).toBe('Laptops');
        });
    });

    it('should throw not found exception', async () => {
        const context = new NodeDataContext( new URL('/api/', server_uri).toString(), {
            useMediaTypeExtensions: false,
            useResponseConversion: true
        });
        const token = await getToken(server_uri, TEST_USER, TEST_PASSWORD);
        context.setBearerAuthorization(token.access_token);
        await expectAsync(context.model('OtherProducts').getItems()).toBeRejectedWithError('Not Found');
    });

    it('should handle invalid response', async () => {
        const token = await getToken(server_uri, TEST_USER, TEST_PASSWORD);

        // add error router
        const addRouter = Router();
        addRouter.get('/api/Errors/', (req, res) => {
            return res.status(409).send('<p>Conflict</p>');
        });
        // find first router
        const route = app._router.stack.find((item: any) => item.name === 'router');
        // and add sample error route at the beginning of its stack
        route.handle.stack.unshift.apply(route.handle.stack, addRouter.stack);
        const context = new NodeDataContext( new URL('/api/', server_uri).toString(), {
            useMediaTypeExtensions: false,
            useResponseConversion: true
        });
        context.setBearerAuthorization(token.access_token);
        await expectAsync(context.model('Errors').getItems()).toBeRejectedWithError('Conflict'); //409
    });

});
